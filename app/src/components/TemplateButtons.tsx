import type { TemplateType } from '@/types';

interface Template {
  id: TemplateType;
  name: string;
  description: string;
}

interface TemplateButtonsProps {
  templates: Template[];
  onTemplateClick: (type: TemplateType) => void;
}

export default function TemplateButtons({ templates, onTemplateClick }: TemplateButtonsProps) {
  return (
    <div className="template-buttons">
      <h3>Quick Templates</h3>
      <div className="button-group">
        {templates.map((template) => (
          <button
            key={template.id}
            className="template-button"
            onClick={() => onTemplateClick(template.id)}
            title={template.description}
          >
            {template.name}
          </button>
        ))}
      </div>
    </div>
  );
}
