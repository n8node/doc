"""
Docling document processing microservice for qoqon.ru.
Accepts uploaded files and returns extracted text, tables, and metadata.
"""

import os
import tempfile
import hashlib
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.responses import JSONResponse
from docling.document_converter import DocumentConverter
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions, EasyOcrOptions
from docling.document_converter import PdfFormatOption

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
}

_converter: Optional[DocumentConverter] = None


def get_converter() -> DocumentConverter:
    """Lazy-init converter with OCR support for Russian + English."""
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

    try:
        converter = get_converter()
        result = converter.convert(tmp_path)
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
            "format": ext,
        })
    except Exception as e:
        raise HTTPException(500, f"Processing failed: {str(e)}")
    finally:
        Path(tmp_path).unlink(missing_ok=True)


@app.get("/formats")
async def supported_formats():
    """Return list of supported document formats."""
    return {
        "formats": sorted(SUPPORTED_EXTENSIONS),
        "ocr_languages": ["ru", "en"],
    }
