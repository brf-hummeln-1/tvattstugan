// Genererar ett VAPID-nyckelpar för webb-push och skriver "PUBLIK PRIVAT" på en rad.
// Används av setup-kommandot i README; den privata nyckeln ska bara till `supabase secrets set`.
import { generateKeyPairSync } from 'node:crypto'

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const pub = publicKey.export({ format: 'jwk' })
const priv = privateKey.export({ format: 'jwk' })
const point = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, 'base64url'), Buffer.from(pub.y, 'base64url')])
console.log(`${point.toString('base64url')} ${priv.d}`)
