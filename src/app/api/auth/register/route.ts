import { NextResponse } from 'next/server'

/**
 * Zelfregistratie is uitgeschakeld.
 *
 * Dit endpoint maakte voorheen een volwaardig account aan voor iedereen die
 * een adres invulde dat eindigt op @workxadvocaten.nl. Dat adres werd nergens
 * geverifieerd (geen bevestigingsmail), dus iedereen op internet kon zichzelf
 * een account geven en daarmee bij gedeelde wachtwoorden, salarissen,
 * beoordelingen en debiteuren.
 *
 * Nieuwe accounts maakt een admin of partner aan via Instellingen → Gebruikers
 * (POST /api/admin/users). Dat is ook al de route voor wachtwoord-resets
 * ("Wachtwoord vergeten?" verwijst naar Hanna), dus voor het team verandert er
 * niets aan het inloggen.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        'Zelf een account aanmaken kan niet meer. Vraag Hanna of een partner om een account voor je aan te maken.',
    },
    { status: 403 }
  )
}
