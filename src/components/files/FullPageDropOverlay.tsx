"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cloud } from "lucide-react";

export function FullPageDropOverlay() {
  const [visible, setVisible] = useState(false);
  const dragCountRef = useRef(0);

  const extractFiles = useCallback((e: DragEvent) => {
    const items = Array.from(e.dataTransfer?.items ?? []);
    const fromItems = items
      .filter((i) => i.kind === "file")
      .map((i) => i.getAsFile())
      .filter((f): f is File => Boolean(f));
    return fromItems.length > 0 ? fromItems : Array.from(e.dataTransfer?.files ?? []);
  }, []);

  useEffect(() => {
    const onEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes("Files")) return;
      e.preventDefault();
      dragCountRef.current += 1;
      setVisible(true);
    };

    const onOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes("Files")) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };

    const onLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCountRef.current -= 1;
      if (dragCountRef.current <= 0) {
        dragCountRef.current = 0;
        setVisible(false);
      }
    };

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCountRef.current = 0;
      setVisible(false);
      const files = extractFiles(e);
      if (files.length > 0) {
        window.dispatchEvent(
          new CustomEvent("files:drop-upload", { detail: { files } })
        );
      }
    };

    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);

    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [extractFiles]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ pointerEvents: "none" }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />

          {/* Animated grid pattern */}
          <motion.div
            animate={{ backgroundPosition: ["0% 0%", "100% 100%"] }}
            transition={{ duration: 4, repeat: Infinity, repeatType: "reverse" }}
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(circle, hsl(var(--primary)) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />

          {/* Corner accents */}
          <div className="absolute inset-6 rounded-3xl border-2 border-dashed border-primary/50">
            <motion.div
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 rounded-3xl"
              style={{ boxShadow: "inset 0 0 40px hsl(var(--primary) / 0.1)" }}
            />
          </div>

          {/* Center content */}
          <motion.div
            initial={{ scale: 0.8, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="relative flex flex-col items-center gap-4"
          >
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary text-white shadow-2xl shadow-primary/40"
            >
              <Cloud className="h-10 w-10" />
            </motion.div>

            <div className="text-center">
              <motion.p
                animate={{ scale: [1, 1.03, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-2xl font-bold text-foreground"
              >
                Отпустите для загрузки
              </motion.p>
              <p className="mt-1 text-sm text-muted-foreground">
                Файлы будут загружены в текущую папку
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
