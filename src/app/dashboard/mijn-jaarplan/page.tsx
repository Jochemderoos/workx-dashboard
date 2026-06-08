// Mijn Jaarplan is samengevoegd met Ontwikkelplan. Redirect naar /ontwikkelplannen.
import { redirect } from 'next/navigation'

export default function MijnJaarplanPage() {
  redirect('/dashboard/ontwikkelplannen')
}
