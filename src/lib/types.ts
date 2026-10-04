export type Apartment = {
  id: string
  label: string
  created_at: string
}

export type Resident = {
  id: string
  apartment_id: string | null
  name: string
  email: string
  phone: string | null
  is_admin: boolean
  created_at: string
}

export type ResidentWithApartment = Resident & {
  apartment: Pick<Apartment, 'id' | 'label'> | null
}
