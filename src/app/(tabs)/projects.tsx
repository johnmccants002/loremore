import { EmptyState, JournalScreen, Note } from '@/components/JournalScreen';

export default function Screen() {
  return (
    <JournalScreen eyebrow={"THREADS THROUGH YOUR DAYS"} title={"Make room for what matters."} description={"Follow the ideas, work, and pursuits that give your days a direction."}>
      <EmptyState icon="layers-outline" title={"Every project starts somewhere"}>{"Your projects and their connected moments will live here. Project creation is coming in a later update."}</EmptyState>
      <Note title={"Small steps, longer stories"}>{"A conversation, a decision, a little progress. Keep the moments that show how an idea grows."}</Note>
    </JournalScreen>
  );
}
