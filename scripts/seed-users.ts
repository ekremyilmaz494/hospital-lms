import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'demo123456' // secret-scanner-disable-line

const USERS = [
  { email: 'super@demo.com', password: DEMO_PASSWORD, role: 'super_admin', name: 'Süper Admin' },
  { email: 'admin@demo.com', password: DEMO_PASSWORD, role: 'admin', name: 'Dr. Ahmet Yılmaz' },
  { email: 'staff@demo.com', password: DEMO_PASSWORD, role: 'staff', name: 'Elif Kaya' },
]

async function seedUsers() {
  for (const user of USERS) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { role: user.role, full_name: user.name },
    })

    if (error) {
      if (error.message.includes('already been registered')) {
        console.log(`✓ ${user.email} zaten mevcut`)
      } else {
        console.error(`✗ ${user.email}: ${error.message}`)
      }
    } else {
      console.log(`✓ ${user.email} oluşturuldu (${user.role})`)
    }
  }
}

seedUsers()
