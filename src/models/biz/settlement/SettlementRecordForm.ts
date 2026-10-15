export type SettlementCategory = 'detail' | 'design'

export interface SettlementPricingRecord {
  id: string
  category: SettlementCategory
  pricingCode: string
  itemName: string
  calcProcess: string
  unitPrice: number
  unit: string
  remark: string
  seq: number
}

export interface SettlementRecord {
  id: string
  year: number
  month: number
  seq: number
  category: SettlementCategory
  name: string
  projectNo: string
  quantity: number
  unit: string
  unitPrice: number
  totalPrice: number
  coefficient: number
  pricingCode: string
  settlementYear: number | null
  settlementMonth: number | null
  issueYear: number | null
  issueMonth: number | null
}

export interface SettlementRecordEditForm {
  name: string
  projectNo: string
  quantity: number | null
  unit: string
  unitPrice: number | null
  coefficient: number | null
  pricingCode: string
  settlementYear: number | null
  settlementMonth: number | null
  issueYear: number | null
  issueMonth: number | null
}

export interface SettlementRecordRow extends SettlementRecord {
  pricingItemName?: string
}

export interface SettlementPendingItem {
  id: string
  category: SettlementCategory
  seq: number
  name: string
  projectNo: string
  quantity: number
  unit: string
  unitPrice: number
  totalPrice: number
  coefficient: number
  pricingCode: string
  issueYear: number | null
  issueMonth: number | null
}

export interface SettlementPendingRow extends SettlementPendingItem {
  pricingItemName?: string
}

export class SettlementRecordForm {
  static readonly CATEGORY_DETAIL: SettlementCategory = 'detail'
  static readonly CATEGORY_DESIGN: SettlementCategory = 'design'

  static readonly CATEGORY_TABS: Array<{ key: SettlementCategory; label: string }> = [
    { key: 'detail', label: '细化结算' },
    { key: 'design', label: '设计结算' },
  ]

  static getCurrentYear(): number {
    return new Date().getFullYear()
  }

  static getCurrentMonth(): number {
    return new Date().getMonth() + 1
  }

  static formatMonthLabel(year: number, month: number): string {
    return `${year}年${month}月`
  }

  static shiftMonth(year: number, month: number, delta: number) {
    let nextYear = year
    let nextMonth = month + delta
    while (nextMonth < 1) {
      nextMonth += 12
      nextYear -= 1
    }
    while (nextMonth > 12) {
      nextMonth -= 12
      nextYear += 1
    }
    return { year: nextYear, month: nextMonth }
  }

  static buildTitle(year: number, month: number, category: SettlementCategory): string {
    const tab = SettlementRecordForm.CATEGORY_TABS.find((item) => item.key === category)
    return `${SettlementRecordForm.formatMonthLabel(year, month)}${tab?.label ?? '结算'}`
  }

  static calcTotalPrice(
    quantity: number | null | undefined,
    unitPrice: number | null | undefined,
    coefficient: number | null | undefined,
  ): number {
    const q = Number(quantity) || 0
    const p = Number(unitPrice) || 0
    const c = Number(coefficient) || 1
    return Math.round(q * p * c * 10000) / 10000
  }

  static formatAmount(value: number | null | undefined): string {
    const num = Number(value) || 0
    return num.toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })
  }

  static formatYearMonth(year: number | null | undefined, month: number | null | undefined): string {
    if (!year || !month) return '-'
    return `${year}-${String(month).padStart(2, '0')}`
  }

  static buildPricingMap(records: SettlementPricingRecord[]) {
    const map = new Map<string, SettlementPricingRecord>()
    for (const record of records) {
      map.set(`${record.category}:${record.pricingCode.toUpperCase()}`, record)
    }
    return map
  }

  static enrichPendingRows(
    records: SettlementPendingItem[],
    pricingMap: Map<string, SettlementPricingRecord>,
  ): SettlementPendingRow[] {
    return records.map((record) => {
      const pricing = pricingMap.get(`${record.category}:${record.pricingCode.toUpperCase()}`)
      return {
        ...record,
        pricingItemName: pricing?.itemName ?? '',
      }
    })
  }

  static normalizePendingRows(
    rows: SettlementPendingRow[],
    category: SettlementCategory,
  ): SettlementPendingRow[] {
    return rows.map((row, index) => ({
      ...row,
      category,
      seq: index + 1,
      totalPrice: SettlementRecordForm.calcTotalPrice(row.quantity, row.unitPrice, row.coefficient),
    }))
  }

  static buildPendingSavePayload(
    rows: SettlementPendingRow[],
    category: SettlementCategory,
  ): SettlementPendingItem[] {
    return SettlementRecordForm.normalizePendingRows(rows, category).map((row) => ({
      id: row.id,
      category: row.category,
      seq: row.seq,
      name: row.name.trim(),
      projectNo: row.projectNo.trim().toUpperCase(),
      quantity: Number(row.quantity) || 0,
      unit: row.unit.trim(),
      unitPrice: Number(row.unitPrice) || 0,
      totalPrice: SettlementRecordForm.calcTotalPrice(row.quantity, row.unitPrice, row.coefficient),
      coefficient: Number(row.coefficient) || 1,
      pricingCode: row.pricingCode.trim().toUpperCase(),
      issueYear: row.issueYear,
      issueMonth: row.issueMonth,
    }))
  }

  static enrichRows(
    records: SettlementRecord[],
    pricingMap: Map<string, SettlementPricingRecord>,
  ): SettlementRecordRow[] {
    return records.map((record) => {
      const pricing = pricingMap.get(`${record.category}:${record.pricingCode.toUpperCase()}`)
      return {
        ...record,
        pricingItemName: pricing?.itemName ?? '',
      }
    })
  }

  static normalizeRows(
    rows: SettlementRecordRow[],
    year: number,
    month: number,
    category: SettlementCategory,
  ): SettlementRecordRow[] {
    return rows.map((row, index) => ({
      ...row,
      year,
      month,
      category,
      seq: index + 1,
      settlementYear: row.settlementYear ?? year,
      settlementMonth: row.settlementMonth ?? month,
      issueYear: row.issueYear ?? row.settlementYear ?? year,
      issueMonth: row.issueMonth ?? row.settlementMonth ?? month,
      totalPrice: SettlementRecordForm.calcTotalPrice(row.quantity, row.unitPrice, row.coefficient),
    }))
  }

  static buildSavePayload(
    rows: SettlementRecordRow[],
    year: number,
    month: number,
    category: SettlementCategory,
  ): SettlementRecord[] {
    return SettlementRecordForm.normalizeRows(rows, year, month, category).map((row) => ({
      id: row.id,
      year: row.year,
      month: row.month,
      seq: row.seq,
      category: row.category,
      name: row.name.trim(),
      projectNo: row.projectNo.trim().toUpperCase(),
      quantity: Number(row.quantity) || 0,
      unit: row.unit.trim(),
      unitPrice: Number(row.unitPrice) || 0,
      totalPrice: SettlementRecordForm.calcTotalPrice(row.quantity, row.unitPrice, row.coefficient),
      coefficient: Number(row.coefficient) || 1,
      pricingCode: row.pricingCode.trim().toUpperCase(),
      settlementYear: row.settlementYear,
      settlementMonth: row.settlementMonth,
      issueYear: row.issueYear,
      issueMonth: row.issueMonth,
    }))
  }

  static createEmptyRow(
    year: number,
    month: number,
    category: SettlementCategory,
    seq: number,
  ): SettlementRecordRow {
    return {
      id: '',
      year,
      month,
      seq,
      category,
      name: '',
      projectNo: '',
      quantity: 0,
      unit: '',
      unitPrice: 0,
      totalPrice: 0,
      coefficient: 1,
      pricingCode: '',
      settlementYear: year,
      settlementMonth: month,
      issueYear: year,
      issueMonth: month,
      pricingItemName: '',
    }
  }

  static applyPricingToRow(
    row: SettlementRecordRow,
    pricing: SettlementPricingRecord | undefined,
  ): SettlementRecordRow {
    if (!pricing) return row
    return {
      ...row,
      pricingCode: pricing.pricingCode,
      unitPrice: pricing.unitPrice,
      unit: pricing.unit,
      pricingItemName: pricing.itemName,
      totalPrice: SettlementRecordForm.calcTotalPrice(row.quantity, pricing.unitPrice, row.coefficient),
    }
  }

  static applyEditForm(row: SettlementRecordRow, form: SettlementRecordEditForm): SettlementRecordRow {
    const quantity = Number(form.quantity) || 0
    const unitPrice = Number(form.unitPrice) || 0
    const coefficient = Number(form.coefficient) || 1
    return {
      ...row,
      name: form.name.trim(),
      projectNo: form.projectNo.trim().toUpperCase(),
      quantity,
      unit: form.unit.trim(),
      unitPrice,
      coefficient,
      pricingCode: form.pricingCode.trim().toUpperCase(),
      settlementYear: form.settlementYear,
      settlementMonth: form.settlementMonth,
      issueYear: form.issueYear,
      issueMonth: form.issueMonth,
      totalPrice: SettlementRecordForm.calcTotalPrice(quantity, unitPrice, coefficient),
    }
  }

  static toEditForm(row: SettlementRecordRow): SettlementRecordEditForm {
    return {
      name: row.name,
      projectNo: row.projectNo,
      quantity: row.quantity,
      unit: row.unit,
      unitPrice: row.unitPrice,
      coefficient: row.coefficient,
      pricingCode: row.pricingCode,
      settlementYear: row.settlementYear,
      settlementMonth: row.settlementMonth,
      issueYear: row.issueYear,
      issueMonth: row.issueMonth,
    }
  }

  static sumTotalPrice(rows: SettlementRecordRow[]): number {
    return rows.reduce((sum, row) => sum + (Number(row.totalPrice) || 0), 0)
  }
}
