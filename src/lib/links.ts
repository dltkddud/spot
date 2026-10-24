// LinkedIn links are checked lightly in the browser; the server checks again.
const LINKEDIN = /^(https?:\/\/)?([a-z]{2,3}\.)?linkedin\.com\/\S+$/i;

export function looksLikeLinkedin(url: string) {
  return LINKEDIN.test(url.trim());
}

export function linkHref(url: string) {
  if (url.includes("@") && !url.includes("/")) return `mailto:${url}`;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}
