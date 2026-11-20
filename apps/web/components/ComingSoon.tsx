import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPersonDigging } from '@fortawesome/free-solid-svg-icons';

/** หน้าชั่วคราวระหว่างพัฒนา — จะถูกแทนที่ด้วยหน้าจริงทีละหน้า */
export function ComingSoon({ name }: { name: string }) {
  return (
    <section className="max-w-7xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
        <FontAwesomeIcon icon={faPersonDigging} className="text-4xl mb-3 text-slate-300" />
        <p className="font-medium text-slate-500">{name} hasn&apos;t been built yet.</p>
        <p className="text-sm mt-1">Navigation and access for this page already work.</p>
      </div>
    </section>
  );
}
