import HeroSection from '../components/sections/HeroSection';
import StatsBar from '../components/ui/StatsBar';
import FeaturedEvents from '../components/sections/FeaturedEvents';
import HowItWorks from '../components/sections/HowItWorks';
import CTABanner from '../components/sections/CTABanner';

export default function HomePage() {
    return (
        <main>
            <HeroSection />
            <StatsBar />
            <FeaturedEvents />
            <HowItWorks />
            <CTABanner />
        </main>
    );
}