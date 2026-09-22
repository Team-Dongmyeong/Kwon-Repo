import Header from '../components/Header.jsx'
import HomeBanner from '../components/HomeBanner.jsx'
import ServiceIntro from '../components/ServiceIntro.jsx'
import TrustSection from '../components/TrustSection.jsx'
import BottomCTA from '../components/BottomCTA.jsx'
import Footer from '../components/Footer.jsx'

export default function Landing() {
  return (
    <div className="min-h-dvh bg-canvas">
      <Header />
      <main>
        <HomeBanner />
        <ServiceIntro />
        <TrustSection />
        <BottomCTA />
      </main>
      <Footer />
    </div>
  )
}
