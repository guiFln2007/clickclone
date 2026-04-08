import { NextResponse } from 'next/server'

// Endpoint desativado — atualizações manuais foram removidas.
// Todas as ofertas são atualizadas automaticamente 1x/dia às 07:00 BRT
// via GitHub Actions → /api/cron/check-radar (com dedup por page_id).
export async function PATCH() {
  return NextResponse.json({
    error: 'Atualização manual desativada. As ofertas são atualizadas automaticamente todos os dias às 07:00 (horário de Brasília).',
  }, { status: 410 })
}
