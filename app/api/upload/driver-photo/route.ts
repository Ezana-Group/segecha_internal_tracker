import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const BUCKET = 'driver-uploads'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const folder = (formData.get('folder') as string) || 'photos'
    if (!file || !file.size) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { data: bucketList } = await supabase.storage.listBuckets()
    if (!bucketList?.find((b: any) => b.name === BUCKET)) {
      await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 10485760 })
    }
    const { data, error } = await supabase.storage.from(BUCKET).upload(path, await file.arrayBuffer(), {
      contentType: file.type || 'image/jpeg',
      upsert: true,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path)
    return NextResponse.json({ url: urlData.publicUrl })
  } catch (e: any) {
    console.error('Upload error:', e)
    return NextResponse.json({ error: e.message || 'Upload failed' }, { status: 500 })
  }
}
