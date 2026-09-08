import { useEffect, type ReactNode } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/feedback";
import { setTokenGetter } from "@/lib/api";

/** Pantalla completa centrada (para estados de carga / login). */
function FullScreen({ children }: { children: ReactNode }) {
  return <div className="flex h-full items-center justify-center p-6">{children}</div>;
}

/** Controla el acceso: exige login y conecta el token a la capa de API. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, error, loginWithRedirect, getAccessTokenSilently } = useAuth0();

  // Conecta el proveedor de token para que api.ts adjunte el Bearer en cada llamada.
  useEffect(() => {
    if (isAuthenticated) {
      setTokenGetter(() => getAccessTokenSilently());
    }
    return () => setTokenGetter(null);
  }, [isAuthenticated, getAccessTokenSilently]);

  if (isLoading) {
    return (
      <FullScreen>
        <span className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Cargando…
        </span>
      </FullScreen>
    );
  }

  if (error) {
    return (
      <FullScreen>
        <div className="max-w-sm text-center">
          <p className="text-sm font-medium text-red-600">No se pudo iniciar sesión</p>
          <p className="mt-1 text-xs text-slate-500">{error.message}</p>
          <Button className="mt-4" onClick={() => loginWithRedirect()}>
            Reintentar
          </Button>
        </div>
      </FullScreen>
    );
  }

  if (!isAuthenticated) {
    return (
      <FullScreen>
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">DataFilter</h1>
          <p className="mt-1 text-sm text-slate-500">
            Sube archivos grandes, fíltralos y descarga solo el resultado.
          </p>
          <Button className="mt-6 w-full" onClick={() => loginWithRedirect()}>
            Iniciar sesión
          </Button>
        </div>
      </FullScreen>
    );
  }

  return <>{children}</>;
}
