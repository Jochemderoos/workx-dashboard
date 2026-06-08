// Partner-overzicht van jaarplannen is samengevoegd met Ontwikkelplannen.
// Partners zien hier nu een redirect — selecteren teamlid kan in /ontwikkelplannen.
import { redirect } from 'next/navigation'

export default function PartnersJaarplannenPage() {
  redirect('/dashboard/ontwikkelplannen')
}
