import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Reveal } from "@/components/landing/Reveal";

const FAQ: [string, string][] = [
  ["Does Finley change my forecast?", "No. It flags and explains. You decide what goes into the model."],
  ["Where does the data come from?", "Live news search across trade press, company statements and government sources, collected through Bright Data. Every finding links to its sources."],
  ["How accurate is it?", "Each finding carries materiality, reliability and confidence scores, and code caps confidence when evidence is thin. Impacts are illustrative scenarios, not forecasts."],
  ["Is my client data safe?", "Client profiles stay in your workspace. Only search terms and public articles are sent to the analysis models."],
];

export function FaqSection() {
  return (
    <section id="faq" className="max-w-2xl mx-auto px-6 py-20">
      <Reveal><h2 className="text-2xl font-semibold mb-6 text-center">FAQ</h2></Reveal>
      <Accordion type="single" collapsible defaultValue="0" className="space-y-3">
        {FAQ.map(([q, a], i) => (
          <AccordionItem key={q} value={String(i)} className="rounded-xl bg-card border border-border px-4">
            <AccordionTrigger className="text-sm hover:no-underline">{q}</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">{a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
