import { Nav } from '@/components/Nav'
import { Hero } from '@/components/Hero'
import { PhoneMockup } from '@/components/PhoneMockup'
import { Features } from '@/components/Features'
import { Footer } from '@/components/Footer'

export default function HomePage() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <PhoneMockup />
        <Features />
      </main>
      <Footer />
    </>
  )
}
