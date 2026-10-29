export function patientIdFromPath(pathname) {
  const match = /^\/(?:patients\/)?(PAT-[0-9A-F]{32})\/?$/i.exec(pathname);
  return match ? match[1].toUpperCase() : null;
}

export function patientDeepLinkRedirect(location) {
  return patientIdFromPath(location.pathname) ? `${location.origin}${location.pathname}${location.search}` : undefined;
}
