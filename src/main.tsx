import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Auth0Provider } from "@auth0/auth0-react";
import "./index.css";
import { App } from "./App";
import { auth0Config, authEnabled } from "./auth/authConfig";
import { AuthGate } from "./auth/AuthGate";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("No se encontró el elemento raíz #root");
}

// Con auth habilitada, la app va detrás del login de Auth0; sin ella (dev), directa.
const tree = authEnabled ? (
  <Auth0Provider
    domain={auth0Config.domain}
    clientId={auth0Config.clientId}
    authorizationParams={{
      redirect_uri: window.location.origin,
      audience: auth0Config.audience,
      scope: "openid profile email offline_access",
    }}
    cacheLocation="localstorage"
    useRefreshTokens
  >
    <AuthGate>
      <App />
    </AuthGate>
  </Auth0Provider>
) : (
  <App />
);

createRoot(rootElement).render(<StrictMode>{tree}</StrictMode>);
