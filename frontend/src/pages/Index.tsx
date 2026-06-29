import Nav from "@/components/pulse/Nav";
import Hero from "@/components/pulse/Hero";
import Marquee from "@/components/pulse/Marquee";
import Stats from "@/components/pulse/Stats";
import Features from "@/components/pulse/Features";
import Pipeline from "@/components/pulse/Pipeline";
import Deploy from "@/components/pulse/Deploy";
import Quote from "@/components/pulse/Quote";
import Integrations from "@/components/pulse/Integrations";
import CTA from "@/components/pulse/CTA";
import Footer from "@/components/pulse/Footer";

const Index = () => {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />
      <Hero />
      <Marquee />
      <Stats />
      <Features />
      <Pipeline />
      <Deploy />
      <Quote />
      <Integrations />
      <CTA />
      <Footer />
    </main>
  );
};

export default Index;
