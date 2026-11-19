"use client";

import { BellRinging } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { saveSubscription } from "@/lib/push/actions";
import { type PushSupport, pushSupportState } from "@/lib/push/support";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i += 1) {
    bytes[i] = rawData.charCodeAt(i);
  }
  return bytes;
}

export function PushToggle() {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    const state = pushSupportState({
      userAgent: navigator.userAgent,
      isStandalone: window.matchMedia("(display-mode: standalone)").matches,
      hasPushManager: "PushManager" in window,
    });
    setSupport(state);

    if (state === "disponible") {
      void navigator.serviceWorker.ready.then((registration) => {
        void registration.pushManager.getSubscription().then((sub) => {
          setIsSubscribed(sub !== null);
        });
      });
    }
  }, []);

  if (!vapidKey || support === null) return null;

  if (support === "instalar") {
    return (
      <p className="text-sm text-muted-foreground">
        Para recibir avisos, instala HomeBoard: en Safari toca Compartir y luego &ldquo;Añadir a pantalla de
        inicio&rdquo;.
      </p>
    );
  }

  if (support === "no-soportado") {
    return <p className="text-sm text-muted-foreground">Este navegador no admite notificaciones.</p>;
  }

  if (isSubscribed) {
    return <p className="text-sm font-medium text-success">Notificaciones activadas</p>;
  }

  async function handleClick() {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      toast("Puedes activarlas luego en Ajustes del iPhone");
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey as string),
    });
    const result = await saveSubscription(subscription.toJSON());
    if (result.ok) {
      setIsSubscribed(true);
      toast.success("Notificaciones activadas");
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-on-primary"
    >
      <BellRinging weight="regular" size={18} aria-hidden />
      Activar notificaciones
    </button>
  );
}
