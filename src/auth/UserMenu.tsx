import { useAuth0 } from "@auth0/auth0-react";
import { Button } from "@/components/ui/button";

/** Muestra el usuario autenticado y permite cerrar sesión.
 *  Solo se monta cuando la autenticación está habilitada (dentro del Auth0Provider).
 */
export function UserMenu() {
  const { user, logout } = useAuth0();

  return (
    <div className="flex items-center gap-3">
      <span className="hidden max-w-[200px] truncate text-xs text-slate-500 sm:inline" title={user?.email}>
        {user?.email ?? user?.name}
      </span>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
      >
        Cerrar sesión
      </Button>
    </div>
  );
}
