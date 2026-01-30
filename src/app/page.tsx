import { redirect } from 'next/navigation'

export default async function Home() {
  // Tijdelijk: direct naar dashboard zonder login
  redirect('/dashboard')
}
