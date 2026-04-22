"use client";

import Script from "next/script";
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, unknown>) => string;
      execute: (widgetId: string) => void;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

export type TurnstileMode = "invisible" | "interactive";

export type TurnstileWidgetHandle = {
  execute: () => Promise<string>;
  reset: () => void;
  getToken: () => string | null;
};

export function getTurnstileModeFromEnv(): TurnstileMode {
  const raw = (process.env.NEXT_PUBLIC_TURNSTILE_MODE || "").toLowerCase().trim();
  return raw === "interactive" ? "interactive" : "invisible";
}

export function isTurnstileEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim());
}

export const TurnstileWidget = forwardRef<
  TurnstileWidgetHandle,
  {
    mode?: TurnstileMode;
    action?: string;
    cdata?: string;
    className?: string;
    onError?: (message: string) => void;
    onExpire?: () => void;
  }
>(function TurnstileWidget(
  { mode = getTurnstileModeFromEnv(), action, cdata, className, onError, onExpire },
  ref
) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || "";
  const enabled = Boolean(siteKey);
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const isExecutingRef = useRef(false);
  const inFlightRef = useRef<Promise<string> | null>(null);

  const size = useMemo(() => (mode === "interactive" ? "normal" : "invisible"), [mode]);

  const waitForReady = useCallback(async () => {
    if (!enabled) return;
    const startedAt = Date.now();
    const timeoutMs = 12_000;
    while (Date.now() - startedAt < timeoutMs) {
      if (
        scriptReady &&
        widgetIdRef.current &&
        typeof window !== "undefined" &&
        window.turnstile?.execute
      ) {
        return;
      }
      await new Promise((r) => window.setTimeout(r, 50));
    }
    throw new Error("Turnstile not ready.");
  }, [enabled, scriptReady]);

  const renderWidget = useCallback(() => {
    if (!enabled) return;
    if (!scriptReady) return;
    const container = containerRef.current;
    if (!container) return;
    if (!window.turnstile?.render) return;

    // Re-render cleanly
    if (widgetIdRef.current && window.turnstile?.remove) {
      try {
        window.turnstile.remove(widgetIdRef.current);
      } catch {
        /* ignore */
      }
      widgetIdRef.current = null;
    }
    container.innerHTML = "";
    setToken(null);
    tokenRef.current = null;

    const id = window.turnstile.render(container, {
      sitekey: siteKey,
      size,
      action,
      cData: cdata,
      callback: (t: string) => {
        tokenRef.current = t;
        setToken(t);
      },
      "error-callback": () => onError?.("Turnstile failed. Please try again."),
      "expired-callback": () => {
        tokenRef.current = null;
        setToken(null);
        onExpire?.();
      },
    });
    widgetIdRef.current = id;
  }, [action, cdata, enabled, onError, onExpire, scriptReady, siteKey, size]);

  useEffect(() => {
    renderWidget();
    return () => {
      const id = widgetIdRef.current;
      if (id && window.turnstile?.remove) {
        try {
          window.turnstile.remove(id);
        } catch {
          /* ignore */
        }
      }
      widgetIdRef.current = null;
    };
  }, [renderWidget]);

  const execute = useCallback(async () => {
    if (!enabled) return "";
    if (mode === "interactive") {
      const t = tokenRef.current;
      if (!t) throw new Error("Complete the Turnstile checkbox.");
      return t;
    }

    // Single-flight: if an invisible challenge is already executing, just await it.
    if (isExecutingRef.current && inFlightRef.current) {
      return await inFlightRef.current;
    }

    await waitForReady();
    const id = widgetIdRef.current;
    if (!id) throw new Error("Turnstile not ready.");
    if (!window.turnstile?.execute) throw new Error("Turnstile not ready.");

    // Invisible mode: execute produces a new token via callback.
    tokenRef.current = null;
    setToken(null);
    isExecutingRef.current = true;
    const p = new Promise<string>((resolve, reject) => {
      try {
        window.turnstile!.execute(id);
      } catch (e) {
        reject(e instanceof Error ? e : new Error("Turnstile execute failed."));
        return;
      }

      const startedAt = Date.now();
      const timeoutMs = 12_000;
      const interval = window.setInterval(() => {
        const current = tokenRef.current;
        if (current) {
          window.clearInterval(interval);
          resolve(current);
          return;
        }
        if (Date.now() - startedAt > timeoutMs) {
          window.clearInterval(interval);
          reject(new Error("Turnstile timed out."));
        }
      }, 50);
    }).finally(() => {
      isExecutingRef.current = false;
      inFlightRef.current = null;
    });

    inFlightRef.current = p;
    return await p;
  }, [enabled, mode, waitForReady]);

  const reset = useCallback(() => {
    const id = widgetIdRef.current;
    if (!id) return;
    try {
      window.turnstile?.reset?.(id);
    } finally {
      isExecutingRef.current = false;
      inFlightRef.current = null;
      tokenRef.current = null;
      setToken(null);
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      execute,
      reset,
      getToken: () => token,
    }),
    [execute, reset, token]
  );

  if (!enabled) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
      <div className={className} ref={containerRef} />
    </>
  );
});

