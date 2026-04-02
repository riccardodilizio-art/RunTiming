import HeroSection from '../components/sections/HeroSection';
import FeaturedEvents from '../components/sections/FeaturedEvents';
import OrganizerCTA from '../components/sections/OrganizerCTA';

export default function HomePage() {
    return (
        <main>
            <HeroSection />
            <FeaturedEvents />
            <OrganizerCTA />
        </main>
    );
}
