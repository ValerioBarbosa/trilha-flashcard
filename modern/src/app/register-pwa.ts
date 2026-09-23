export type PwaRegistrationState = {
  supported: boolean;
  registered: boolean;
  scope?: string;
  error?: string;
};

export async function registerModernPwa(): Promise<PwaRegistrationState> {
  if (!('serviceWorker' in navigator)) return { supported: false, registered: false };

  try {
    const registration = await navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' });
    await registration.update();

    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });

    return { supported: true, registered: true, scope: registration.scope };
  } catch (cause) {
    return {
      supported: true,
      registered: false,
      error: cause instanceof Error ? cause.message : String(cause),
    };
  }
}
