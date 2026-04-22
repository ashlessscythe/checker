type TurnstileVerifyOk = {
  ok: true;
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
};

type TurnstileVerifyFail = {
  ok: false;
  error: string;
  codes?: string[];
};

export async function verifyTurnstileToken(opts: {
  token: string | null | undefined;
  remoteIp?: string | null;
  action?: string;
  cdata?: string;
}): Promise<TurnstileVerifyOk | TurnstileVerifyFail> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  const enabled = Boolean(secret) && Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim());

  if (!enabled) {
    return { ok: true };
  }

  const token = (opts.token ?? "").trim();
  if (!token) return { ok: false, error: "Missing Turnstile token." };

  const form = new FormData();
  form.set("secret", secret!);
  form.set("response", token);
  if (opts.remoteIp) form.set("remoteip", opts.remoteIp);

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    return { ok: false, error: "Turnstile verification failed (network)." };
  }

  const data = (await res.json().catch(() => null)) as
    | null
    | {
        success?: boolean;
        "error-codes"?: string[];
        challenge_ts?: string;
        hostname?: string;
        action?: string;
        cdata?: string;
      };

  if (!data?.success) {
    return {
      ok: false,
      error: "Turnstile verification failed.",
      codes: Array.isArray(data?.["error-codes"]) ? data?.["error-codes"] : undefined,
    };
  }

  if (opts.action && data.action && opts.action !== data.action) {
    return { ok: false, error: "Turnstile action mismatch.", codes: data["error-codes"] };
  }
  if (opts.cdata && data.cdata && opts.cdata !== data.cdata) {
    return { ok: false, error: "Turnstile cdata mismatch.", codes: data["error-codes"] };
  }

  return {
    ok: true,
    challenge_ts: data.challenge_ts,
    hostname: data.hostname,
    action: data.action,
    cdata: data.cdata,
  };
}

