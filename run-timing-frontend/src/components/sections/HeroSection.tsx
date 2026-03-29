export default function HeroSection() {
    return (
        <section
            className="py-10 px-4 text-center"
            style={{ background: 'linear-gradient(135deg, #0a3c6e 0%, #0168c8 100%)' }}
        >
            <div className="max-w-5xl mx-auto">
                <h1 className="font-display font-800 text-4xl md:text-5xl text-white mb-2">
                    RunTiming
                </h1>
                <p className="text-sky-200 text-base max-w-lg mx-auto">
                    La piattaforma italiana per iscriversi alle gare, seguire i risultati live
                    e gestire eventi sportivi con cronometraggio in tempo reale.
                </p>
            </div>
        </section>
    );
}
