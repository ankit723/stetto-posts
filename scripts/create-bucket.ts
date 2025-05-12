import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  try {
    // Check if bucket exists
    const { data: buckets, error } = await supabase.storage.listBuckets()
    
    if (error) {
      throw error
    }
    
    const photosBucket = buckets.find(bucket => bucket.name === 'photos')
    
    if (!photosBucket) {
      // Create photos bucket
      const { data, error: createError } = await supabase.storage.createBucket('photos', {
        public: false,
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
        fileSizeLimit: 10485760, // 10MB
      })
      
      if (createError) {
        throw createError
      }
      
      // Set bucket policy to public
      const { error: policyError } = await supabase.storage.from('photos').setPublic()
      
      if (policyError) {
        throw policyError
      }
      
      console.log('Photos bucket created successfully')
    } else {
      console.log('Photos bucket already exists')
    }
  } catch (error) {
    console.error('Error creating bucket:', error)
    process.exit(1)
  }
}

main() 