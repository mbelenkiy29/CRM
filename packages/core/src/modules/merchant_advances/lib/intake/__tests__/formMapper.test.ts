import { detectIntakeProvider, IntakeMappingError, mapFormPayload } from '../formMapper'

describe('merchant_advances formMapper', () => {
  const jotformPayload = {
    formID: '241234567890123',
    submissionID: '6123456789012345678',
    rawRequest: JSON.stringify({
      q3_businessName: 'Harbor Auto Repair',
      q5_requestedAmount: '$50,000',
      q7_averageMonthlyRevenue: '120000',
      q9_timeInBusiness: '24',
      q11_email: 'owner@harborauto.example',
    }),
    q3_businessName: 'Harbor Auto Repair',
    q5_requestedAmount: '$50,000',
    q7_averageMonthlyRevenue: '120000',
    q9_timeInBusiness: '24',
    q11_email: 'owner@harborauto.example',
  }

  const ghlPayload = {
    type: 'ContactCreate',
    locationId: 'loc_1',
    contact: {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@acme.example',
      companyName: 'Acme Logistics',
      customFields: [
        { fieldKey: 'requested_amount', value: '75000' },
        { fieldKey: 'avg_monthly_revenue', value: '90000' },
        { fieldKey: 'time_in_business_months', value: '18' },
      ],
    },
  }

  const zohoPayload = {
    module: 'Leads',
    operation: 'insert',
    ids: ['zcrm_1'],
    data: [
      {
        Company: 'Northside Grill',
        Email: 'pat@northside.example',
        First_Name: 'Pat',
        Last_Name: 'Lee',
        Requested_Amount: '40000',
        Average_Monthly_Revenue: '65000',
        Time_in_Business: '2 years',
      },
    ],
  }

  const customPayload = {
    businessName: 'Custom Widgets LLC',
    requestedAmount: 33000,
    avgMonthlyRevenue: 44000,
    timeInBusinessMonths: 36,
    ownerEmail: 'ops@customwidgets.example',
    ownerUserId: '11111111-1111-4111-8111-111111111111',
    statementUrls: ['https://files.example/stmt.pdf'],
  }

  it('maps a JotForm webhook into required deal fields', () => {
    const mapped = mapFormPayload('jotform', jotformPayload)
    expect(mapped.provider).toBe('jotform')
    expect(mapped.businessName).toBe('Harbor Auto Repair')
    expect(mapped.requestedAmount).toBe('50000')
    expect(mapped.avgMonthlyRevenue).toBe('120000')
    expect(mapped.timeInBusinessMonths).toBe(24)
    expect(mapped.ownerEmail).toBe('owner@harborauto.example')
  })

  it('maps a GoHighLevel contact payload', () => {
    const mapped = mapFormPayload('gohighlevel', ghlPayload)
    expect(mapped.provider).toBe('gohighlevel')
    expect(mapped.businessName).toBe('Acme Logistics')
    expect(mapped.requestedAmount).toBe('75000')
    expect(mapped.avgMonthlyRevenue).toBe('90000')
    expect(mapped.timeInBusinessMonths).toBe(18)
    expect(mapped.ownerEmail).toBe('jane@acme.example')
    expect(mapped.ownerFirstName).toBe('Jane')
    expect(mapped.ownerLastName).toBe('Doe')
  })

  it('maps a Zoho CRM webhook row', () => {
    const mapped = mapFormPayload('zoho', zohoPayload)
    expect(mapped.provider).toBe('zoho')
    expect(mapped.businessName).toBe('Northside Grill')
    expect(mapped.requestedAmount).toBe('40000')
    expect(mapped.avgMonthlyRevenue).toBe('65000')
    expect(mapped.timeInBusinessMonths).toBe(24)
    expect(mapped.ownerEmail).toBe('pat@northside.example')
  })

  it('maps a custom flat payload including assignment and statement URLs', () => {
    const mapped = mapFormPayload('custom', customPayload)
    expect(mapped.provider).toBe('custom')
    expect(mapped.businessName).toBe('Custom Widgets LLC')
    expect(mapped.requestedAmount).toBe('33000')
    expect(mapped.avgMonthlyRevenue).toBe('44000')
    expect(mapped.timeInBusinessMonths).toBe(36)
    expect(mapped.ownerEmail).toBe('ops@customwidgets.example')
    expect(mapped.ownerUserId).toBe('11111111-1111-4111-8111-111111111111')
    expect(mapped.statementUrls).toEqual(['https://files.example/stmt.pdf'])
  })

  it('auto-detects providers from payload shape', () => {
    expect(detectIntakeProvider(jotformPayload)).toBe('jotform')
    expect(detectIntakeProvider(ghlPayload)).toBe('gohighlevel')
    expect(detectIntakeProvider(zohoPayload)).toBe('zoho')
    expect(detectIntakeProvider(customPayload)).toBe('custom')
  })

  it('requires businessName', () => {
    expect(() => mapFormPayload('custom', { requestedAmount: 1000, ownerEmail: 'a@b.com' })).toThrow(IntakeMappingError)
    try {
      mapFormPayload('custom', { requestedAmount: 1000 })
    } catch (err) {
      expect(err).toBeInstanceOf(IntakeMappingError)
      expect((err as IntakeMappingError).code).toBe('business_name_required')
    }
  })

  it('rejects a non-object payload', () => {
    expect(() => mapFormPayload('custom', null)).toThrow(IntakeMappingError)
    expect(() => mapFormPayload('auto', 'Harbor Auto')).toThrow(IntakeMappingError)
  })
})
