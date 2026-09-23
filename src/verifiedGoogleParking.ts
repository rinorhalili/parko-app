export type VerifiedGoogleParkingMarker = {
  markerId: string
  title: string
  address: string
  lat: number
  lng: number
  pricePerHour: 0 | 1
  type: 'private' | 'public'
  open24h: boolean
  covered: boolean
  accessible: boolean
  googleMapsUrl: string
}

// Manually verified against public Google Maps place listings on 2026-09-23.
// Pricing classification requested for Parko: private parking = 1 €/hour;
// public shopping-centre parking = free. Prishtina Parking locations are kept
// in the separate official municipal dataset and are intentionally excluded.
export const VERIFIED_GOOGLE_PARKINGS: VerifiedGoogleParkingMarker[] = [
  {"markerId":"11flr2wppd","title":"PARKING — Zeki Shulemaja","address":"M578+676, Zeki Shulemaja, Prishtinë","lat":42.663036,"lng":21.1656543,"pricePerHour":1,"type":"private","open24h":true,"covered":false,"accessible":true,"googleMapsUrl":"https://www.google.com/maps/place/PARKING/data=!4m7!3m6!1s0x13549f3d5f32f3cb:0x82b04dcea44f333b!8m2!3d42.663036!4d21.1656543!16s%2Fg%2F11flr2wppd"},
  {"markerId":"11vz4hwssm","title":"Garage Parking -1 -2 C/3","address":"Ukshin Hoti 120, Prishtinë","lat":42.6584453,"lng":21.1535972,"pricePerHour":1,"type":"private","open24h":true,"covered":true,"accessible":false,"googleMapsUrl":"https://www.google.com/maps/place/Garage+Parking+-1+-2+C%2F3/data=!4m7!3m6!1s0x13549fcfc1567edf:0x764198bcfa42b7f5!8m2!3d42.6584453!4d21.1535972!16s%2Fg%2F11vz4hwssm"},
  {"markerId":"11lnwv7w2h","title":"Parking Garage — Bashkim Fehmiu","address":"Bashkim Fehmiu, Prishtinë","lat":42.6573499,"lng":21.1476939,"pricePerHour":1,"type":"private","open24h":false,"covered":true,"accessible":false,"googleMapsUrl":"https://www.google.com/maps/place/Parking+Garage/data=!4m7!3m6!1s0x13549ff9e42ea62f:0xb2087d685e760238!8m2!3d42.6573499!4d21.1476939!16s%2Fg%2F11lnwv7w2h"},
  {"markerId":"11t6nv8rnt","title":"Parking Maliqi","address":"Opoja 31, Prishtinë","lat":42.6618398,"lng":21.1634816,"pricePerHour":1,"type":"private","open24h":true,"covered":true,"accessible":false,"googleMapsUrl":"https://www.google.com/maps/place/Parking+Maliqi/data=!4m7!3m6!1s0x13549fbc075ac291:0x6118c479062636b0!8m2!3d42.6618398!4d21.1634816!16s%2Fg%2F11t6nv8rnt"},
  {"markerId":"11jjskhcvl","title":"Parking Mirub","address":"M535+R47, Isa Boletini, Prishtinë","lat":42.6545374,"lng":21.1578096,"pricePerHour":1,"type":"private","open24h":true,"covered":true,"accessible":false,"googleMapsUrl":"https://www.google.com/maps/place/parking+mirub/data=!4m7!3m6!1s0x13549fa66354e30f:0xf36d6be145e7d329!8m2!3d42.6545374!4d21.1578096!16s%2Fg%2F11jjskhcvl"},
  {"markerId":"11qr197jxp","title":"Parking Kalabria","address":"Stacioni i Autobusëve, Prishtinë","lat":42.6494552,"lng":21.1496103,"pricePerHour":1,"type":"private","open24h":true,"covered":true,"accessible":true,"googleMapsUrl":"https://www.google.com/maps/place/Parking+Kalabria/data=!4m7!3m6!1s0x13549fc6b647df3f:0x52ce95b0fe9de85c!8m2!3d42.6494552!4d21.1496103!16s%2Fg%2F11qr197jxp"},
  {"markerId":"11h519y436","title":"Parking Bazaar","address":"36 Lidhja e Prizrenit, Prishtinë","lat":42.6692607,"lng":21.1645067,"pricePerHour":1,"type":"private","open24h":false,"covered":false,"accessible":true,"googleMapsUrl":"https://www.google.com/maps/place/Parking+Bazaar/data=!4m7!3m6!1s0x13549f2283e7de83:0xad1b16d0409a17c4!8m2!3d42.6692607!4d21.1645067!16s%2Fg%2F11h519y436"},
  {"markerId":"11p5ng0cht","title":"BLISSLUXE II | Carwash & Parking","address":"M578+W6V, Prishtinë","lat":42.6648544,"lng":21.1655412,"pricePerHour":1,"type":"private","open24h":false,"covered":false,"accessible":true,"googleMapsUrl":"https://www.google.com/maps/place/BLISSLUXE+II+%7C+CARWASH+%26+PARKING/data=!4m7!3m6!1s0x13549f924cb87917:0xc0f83d631434c343!8m2!3d42.6648544!4d21.1655412!16s%2Fg%2F11p5ng0cht"},
  {"markerId":"11z358nlnm","title":"Parking Qafa","address":"Lah Nimani, Rruga UÇK, Prishtinë","lat":42.6658941,"lng":21.1622311,"pricePerHour":1,"type":"private","open24h":true,"covered":false,"accessible":false,"googleMapsUrl":"https://www.google.com/maps/place/Parking+Qafa/data=!4m7!3m6!1s0x13549f57abc42543:0xe711b6e435e8126a!8m2!3d42.6658941!4d21.1622311!16s%2Fg%2F11z358nlnm"},
  {"markerId":"11zbq62bhd","title":"City Parking","address":"38 Vace Zela, Prishtinë","lat":42.6619026,"lng":21.1659878,"pricePerHour":1,"type":"private","open24h":false,"covered":true,"accessible":false,"googleMapsUrl":"https://www.google.com/maps/place/City+parking/data=!4m7!3m6!1s0x13549f00003927ef:0xc9be11ebef9ca45d!8m2!3d42.6619026!4d21.1659878!16s%2Fg%2F11zbq62bhd"},
  {"markerId":"11zbq56k4w","title":"Auto PARKING","address":"14 Sylejman Vokshi, Prishtinë","lat":42.6605108,"lng":21.1623767,"pricePerHour":1,"type":"private","open24h":false,"covered":false,"accessible":false,"googleMapsUrl":"https://www.google.com/maps/place/Auto+PARKING/data=!4m7!3m6!1s0x13549f002a1900d1:0x95c69075067670ae!8m2!3d42.6605108!4d21.1623767!16s%2Fg%2F11zbq56k4w"},
  {"markerId":"11tdhhk47","title":"Parkingu publik — ETC","address":"Prishtinë 10000","lat":42.6472028,"lng":21.1244283,"pricePerHour":0,"type":"public","open24h":false,"covered":false,"accessible":false,"googleMapsUrl":"https://www.google.com/maps/place/Parking,+Prishtin%C3%AB+10000/data=!4m6!3m5!1s0x13549e6e8da6f069:0xd985e97b3052e580!8m2!3d42.6472028!4d21.1244283!16s%2Fg%2F11tdhhk47"},
  {"markerId":"11pd_jb5nz","title":"Parkingu publik — Central Park","address":"Ali Hadri, Prishtinë","lat":42.6472397,"lng":21.1302891,"pricePerHour":0,"type":"public","open24h":false,"covered":false,"accessible":true,"googleMapsUrl":"https://www.google.com/maps/place/Central+Park/data=!4m7!3m6!1s0x13549f18cce9c347:0x99de83800594d658!8m2!3d42.6472397!4d21.1302891!16s%2Fg%2F11pd_jb5nz"},
  {"markerId":"11g9g_n6b1","title":"Parkingu publik — Royal Mall","address":"Rruga B, Prishtinë","lat":42.6538179,"lng":21.1773421,"pricePerHour":0,"type":"public","open24h":false,"covered":false,"accessible":true,"googleMapsUrl":"https://www.google.com/maps/place/Royal+Mall/data=!4m7!3m6!1s0x13549edaa73c5815:0x8ce096f362fa06bb!8m2!3d42.6538179!4d21.1773421!16s%2Fg%2F11g9g_n6b1"},
  {"markerId":"11hy82f2qw","title":"Parkingu publik — Albi Mall","address":"Zona e Re Industriale, Veternik, Prishtinë","lat":42.6329186,"lng":21.1519423,"pricePerHour":0,"type":"public","open24h":false,"covered":false,"accessible":true,"googleMapsUrl":"https://www.google.com/maps/place/Albi+Mall/data=!4m7!3m6!1s0x13549ffe637b0dd7:0x4594c50f0099efc5!8m2!3d42.6329186!4d21.1519423!16s%2Fg%2F11hy82f2qw"},
]
