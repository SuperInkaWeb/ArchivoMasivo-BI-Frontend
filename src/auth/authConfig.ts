/** Configuración de autenticación (Auth0), leída de variables de entorno.
 *
 * VITE_AUTH_ENABLED=false permite correr en local sin Auth0 (debe ir junto con
 * AUTH_ENABLED=false en el backend). En producción va en true.
 */
export const authEnabled = (import.meta.env.VITE_AUTH_ENABLED ?? "true") !== "false";

export const auth0Config = {
  domain: import.meta.env.VITE_AUTH0_DOMAIN ?? "",
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID ?? "",
  audience: import.meta.env.VITE_AUTH0_AUDIENCE ?? "",
};
