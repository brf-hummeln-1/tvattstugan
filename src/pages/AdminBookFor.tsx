import { useState } from 'react'
import type { Apartment } from '../lib/types'
import { Card, Label, SectionFooter, Select } from '../components/ui'
import { Book } from './Book'

/** Admin bokar och avbokar åt en vald lägenhet. */
export function AdminBookFor({ apartments }: { apartments: Apartment[] }) {
  const [apartmentId, setApartmentId] = useState('')
  const apartment = apartments.find((a) => a.id === apartmentId)

  return (
    <div className="space-y-4">
      <Card>
        <Label htmlFor="bookfor-apartment">Lägenhet</Label>
        <Select id="bookfor-apartment" value={apartmentId} onChange={(e) => setApartmentId(e.target.value)}>
          <option value="">Välj lägenhet</option>
          {apartments.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </Select>
      </Card>
      <SectionFooter>Här kan du boka och avboka åt en lägenhet. Samma regler gäller som när de bokar själva.</SectionFooter>
      {apartment && <Book key={apartment.id} adminFor={apartment} />}
    </div>
  )
}
