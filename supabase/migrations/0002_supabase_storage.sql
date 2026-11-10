-- Supabase only: a public bucket for trip photos, leader photos and gallery media.
-- Uploads go through the API with the service-role key; the bucket is public-read so images load fast from the CDN.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('media', 'media', true, 52428800,
            array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4', 'video/webm'])
    on conflict (id) do nothing;
  end if;
end $$;
