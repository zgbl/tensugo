import versionInfo from "../version.json";

export const APP_VERSION = versionInfo;

export function appSemver(): string {
  return `${APP_VERSION.major}.${APP_VERSION.minor}.${APP_VERSION.patch}`;
}

export function appDisplayVersion(): string {
  return `${APP_VERSION.name} ${appSemver()} ${APP_VERSION.stage}`.trim();
}
