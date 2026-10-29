export function patientIdFromPath(pathname: string): string | null;
export function patientDeepLinkRedirect(location: Pick<Location, 'origin' | 'pathname' | 'search'>): string | undefined;
