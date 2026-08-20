import type { CampaignStatus } from '@/types/app';
import Icon from '../Icon';
import { STATUS_ICON, STATUS_LABEL } from '../CampaignsBoard.logic';

/** Campaign status chip — tinted from the global status tokens. */
export default function StatusBadge({ status }: { status: CampaignStatus }) {
  return (
    <span className={`astatus astatus--${status}`}>
      <Icon name={STATUS_ICON[status]} size={12} />
      {STATUS_LABEL[status]}
    </span>
  );
}
