"""
Docling document processing microservice for qoqon.ru.
Accepts uploaded files and returns extracted text, tables, and metadata.
Supports ASR (audio/video transcription) via Whisper.
Legacy Office formats (.doc, .xls, .ppt) are converted via LibreOffice before processing.
"""

import os
import subprocess
import tempfile
import hashlib
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool
from docling.document_converter import DocumentConverter
from docling.datamodel.base_models import InputFormat
from docling.datamodel import asr_model_specs
from docling.datamodel.pipeline_options import PdfPipelineOptions, EasyOcrOptions, AsrPipelineOptions
from docling.document_converter import PdfFormatOption, AudioFormatOption
from docling.pipeline.asr_pipeline import AsrPipeline

app = FastAPI(
    title="Docling Service",
    description="Document processing API for qoqon.ru",
    version="1.0.0",
)

MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE_MB", "100")) * 1024 * 1024

SUPPORTED_EXTENSIONS = {
    ".pdf", ".docx", ".pptx", ".xlsx", ".html", ".htm",
    ".png", ".jpg", ".jpeg", ".tiff", ".bmp",
    ".txt", ".md", ".csv", ".rtf",
    ".doc", ".xls", ".ppt",  # Legacy Office — конвертируются через LibreOffice
}

# Legacy Office formats: extension -> LibreOffice target format
LEGACY_OFFICE = {
    ".doc": "docx",
    ".xls": "xlsx",
    ".ppt": "pptx",
}

ASR_EXTENSIONS = {
    ".wav", ".mp3", ".m4a", ".aac", ".ogg", ".flac",
    ".mp4", ".avi", ".mov",
}

_converter: Optional[DocumentConverter] = None
_asr_converter: Optional[DocumentConverter] = None


def get_asr_converter() -> DocumentConverter:
    """Lazy-init ASR converter for audio/video transcription (Whisper)."""
    global _asr_converter
    if _asr_converter is None:
        pipeline_options = AsrPipelineOptions()
        pipeline_options.asr_options = asr_model_specs.WHISPER_TURBO
        _asr_converter = DocumentConverter(
            format_options={
                InputFormat.AUDIO: AudioFormatOption(
                    pipeline_cls=AsrPipeline,
                    pipeline_options=pipeline_options,
                )
            }
        )
    return _asr_converter


def _convert_legacy_office_to_ooxml(src_path: str, ext: str) -> str:
    """
    Convert legacy Office (.doc, .xls, .ppt) to Open XML using LibreOffice.
    Returns path to the converted file.
    """
    target_format = LEGACY_OFFICE.get(ext)
    if not target_format:
        raise ValueError(f"Not a legacy Office format: {ext}")
    src = Path(src_path)
    out_dir = src.parent
    result = subprocess.run(
        [
            "libreoffice",
            "--headless",
            "--convert-to",
            target_format,
            "--outdir",
            str(out_dir),
            src_path,
        ],
        capture_output=True,
        text=True,
        timeout=120,
    )
    if result.returncode != 0:
        raise RuntimeError(f"LibreOffice conversion failed: {result.stderr or result.stdout}")
    converted = out_dir / (src.stem + "." + target_format)
    if not converted.exists():
        raise RuntimeError(f"LibreOffice did not produce output: {converted}")
    return str(converted)


def get_converter() -> DocumentConverter:
    """Lazy-init converter. OCR enabled (EasyOCR) for PDFs without text layer; text-layer PDFs use direct extraction."""
    global _converter
    if _converter is None:
        ocr_options = EasyOcrOptions(lang=["ru", "en"])
        pipeline_options = PdfPipelineOptions()
        pipeline_options.do_ocr = True
        pipeline_options.do_table_structure = True
        pipeline_options.table_structure_options.do_cell_matching = True
        pipeline_options.ocr_options = ocr_options

        _converter = DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
            }
        )
    return _converter


@app.get("/health")
async def health():
    return {"status": "ok", "service": "docling"}


@app.post("/extract")
async def extract_document(
    file: UploadFile = File(...),
    output_format: str = Query("markdown", regex="^(markdown|text|json)$"),
):
    """
    Extract text content from an uploaded document.
    Returns extracted text, tables, and document metadata.
    """
    if not file.filename:
        raise HTTPException(400, "Filename is required")

    ext = Path(file.filename).suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            415,
            f"Unsupported format: {ext}. Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(413, f"File too large. Max: {MAX_FILE_SIZE // 1024 // 1024}MB")

    content_hash = hashlib.sha256(content).hexdigest()

    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    converted_path: Optional[str] = None
    try:
        if ext in LEGACY_OFFICE:
            converted_path = _convert_legacy_office_to_ooxml(tmp_path, ext)
            path_to_convert = converted_path
            ext_for_result = "." + LEGACY_OFFICE[ext]
        else:
            path_to_convert = tmp_path
            ext_for_result = ext

        converter = get_converter()
        result = converter.convert(path_to_convert)
        doc = result.document

        if output_format == "markdown":
            text = doc.export_to_markdown()
        elif output_format == "text":
            text = doc.export_to_markdown()
        else:
            text = doc.export_to_markdown()

        tables = []
        for table_ix, table in enumerate(doc.tables):
            try:
                content = table.export_to_markdown() if callable(getattr(table, "export_to_markdown", None)) else str(table)
            except Exception:
                content = str(table)
            tables.append({"index": table_ix, "content": content})

        num_pages_attr = getattr(doc, "num_pages", None)
        num_pages = num_pages_attr() if callable(num_pages_attr) else num_pages_attr

        return JSONResponse({
            "filename": file.filename,
            "content_hash": content_hash,
            "text": text,
            "tables": tables,
            "num_pages": num_pages,
            "format": ext_for_result,
        })
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "Conversion timeout (LibreOffice)")
    except Exception as e:
        raise HTTPException(500, f"Processing failed: {str(e)}")
    finally:
        Path(tmp_path).unlink(missing_ok=True)
        if converted_path and Path(converted_path).exists():
            Path(converted_path).unlink(missing_ok=True)


@app.post("/transcribe")
async def transcribe_media(
    file: UploadFile = File(...),
):
    """
    Transcribe audio or video to Markdown text (paragraphs with timestamps).
    Supports: WAV, MP3, M4A, AAC, OGG, FLAC, MP4, AVI, MOV.
    """
    print(f"[transcribe] Request received: {file.filename}", flush=True)
    if not file.filename:
        raise HTTPException(400, "Filename is required")

    ext = Path(file.filename).suffix.lower()
    if ext not in ASR_EXTENSIONS:
        raise HTTPException(
            415,
            f"Unsupported format: {ext}. Supported: {', '.join(sorted(ASR_EXTENSIONS))}",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(413, f"File too large. Max: {MAX_FILE_SIZE // 1024 // 1024}MB")

    content_hash = hashlib.sha256(content).hexdigest()

    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    def _transcribe(path: str):
        converter = get_asr_converter()
        return converter.convert(path)

    try:
        result = await run_in_threadpool(_transcribe, tmp_path)
        doc = result.document
        text = doc.export_to_markdown()

        return JSONResponse({
            "filename": file.filename,
            "content_hash": content_hash,
            "text": text,
            "format": ext,
        })
    except Exception as e:
        raise HTTPException(500, f"Transcription failed: {str(e)}")
    finally:
        Path(tmp_path).unlink(missing_ok=True)


@app.get("/formats")
async def supported_formats():
    """Return list of supported document formats."""
    return {
        "formats": sorted(SUPPORTED_EXTENSIONS),
        "asr_formats": sorted(ASR_EXTENSIONS),
        "ocr_languages": ["ru", "en"],
    }
