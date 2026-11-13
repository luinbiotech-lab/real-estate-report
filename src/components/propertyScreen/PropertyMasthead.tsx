import { EditOutlined } from '@mui/icons-material';
import { Button } from '@mui/material';
import { classifyPropertyRecord, RECORD_CLASS_LABEL } from '../../domain/sampleProperty';
import { mastheadStats } from '../../domain/propertyDetail/propertyScreenModel';
import type { Property } from '../../types';

/** Title band of the property screen: name, address and the five key numbers with their source tag. */
export default function PropertyMasthead({ property, onEdit }: { property: Property; onEdit: () => void }) {
  const record = classifyPropertyRecord(property);
  return <header className="data-room-header property-screen-header property-masthead">
    <div className="property-masthead-title">
      <div>
        <p className="eyebrow">물건{property.tradeType ? ` · ${property.tradeType}` : ''}{record.recordClass !== 'operational' ? <span className="masthead-sample"> · {RECORD_CLASS_LABEL[record.recordClass]}</span> : null}</p>
        <h1>{property.name}</h1>
        <p>{property.address || '주소 미입력'} · {property.propertyNumber || '물건번호 미입력'}</p>
      </div>
      <div className="actions"><Button startIcon={<EditOutlined />} onClick={onEdit}>물건 수정</Button></div>
    </div>
    <dl className="property-masthead-stats" aria-label="핵심 숫자">
      {mastheadStats(property).map((stat) => <div key={stat.label} className={`masthead-stat tag-${stat.tag === '입력값' ? 'input' : stat.tag === '계산값' ? 'calc' : 'missing'}`}><dt>{stat.label}</dt><dd>{stat.value}</dd><small>{stat.tag}</small></div>)}
    </dl>
  </header>;
}
