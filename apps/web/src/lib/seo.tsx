import { Helmet } from 'react-helmet-async';
import { SITE_URL } from './config';

interface SeoProps { title?: string; description?: string; image?: string; path?: string; jsonLd?: object; noindex?: boolean }

export function Seo({ title, description, image, path, jsonLd, noindex }: SeoProps) {
  const full = title ? `${title} | JoinZipTrip` : "JoinZipTrip | Treks and group trips from Mysuru";
  const url = path ? `${SITE_URL}${path}` : undefined;
  const abs = image && !image.startsWith('data:') ? (image.startsWith('http') ? image : `${SITE_URL}${image}`) : undefined;
  return (
    <Helmet prioritizeSeoTags>
      <title>{full}</title>
      {description && <meta name="description" content={description} />}
      {url && <link rel="canonical" href={url} />}
      <meta property="og:site_name" content="JoinZipTrip" />
      <meta property="og:type" content="website" />
      <meta property="og:title" content={full} />
      {description && <meta property="og:description" content={description} />}
      {url && <meta property="og:url" content={url} />}
      {abs && <meta property="og:image" content={abs} />}
      <meta name="twitter:card" content="summary_large_image" />
      {noindex && <meta name="robots" content="noindex" />}
      {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}
    </Helmet>
  );
}
