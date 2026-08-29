import { parseSpreadsheet } from '../parseSpreadsheet'
import { ingestForwardedLeadEmail, importFromGoogleDrive, parseZipLeadPackage } from '../sources'

describe('parseSpreadsheet', () => {
  it('parses CSV and TSV', () => {
    const csv = parseSpreadsheet({ text: 'Business Name,State\nAcme,TX\n', source: 'csv' })
    expect(csv.rows[0]).toEqual(['Business Name', 'State'])
    const tsv = parseSpreadsheet({ text: 'Business Name\tState\nAcme\tTX\n', source: 'tsv' })
    expect(tsv.delimiter).toBe('\t')
    expect(tsv.rows[1]).toEqual(['Acme', 'TX'])
  })

  it('rejects xlsx until a parser is added', () => {
    expect(() => parseSpreadsheet({ text: '', source: 'xlsx', filename: 'leads.xlsx' })).toThrow(/XLSX/)
  })
})

describe('import source stubs', () => {
  it('throws clear TODOs for zip, Drive, and email', async () => {
    expect(() => parseZipLeadPackage(new Uint8Array())).toThrow(/zip/)
    await expect(importFromGoogleDrive({ folderId: 'folder' })).rejects.toThrow(/Google Drive/)
    await expect(ingestForwardedLeadEmail({ rawMessage: '', intakeAddress: 'leads@example.com' })).rejects.toThrow(/intake email/)
  })
})
