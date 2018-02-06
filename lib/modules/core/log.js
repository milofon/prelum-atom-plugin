'use babel';

const { notifications: notify } = atom;
import plugin from '../../prelum';

function log(type, params) {

    const { title } = params;

    params.dismissable = true;
    
    notify.getNotifications().forEach((item) => {
        if (item.type === 'warning') return;
        item.dismiss();
    });

    switch (type) {
        case 'error':
            const _title = title || 'Ошибка трансляции документа'
            notify.addError('PRELUM: ' + _title, params);
            plugin.bar.enable();
            plugin.processing = false;
            break;
        case 'warning':
            notify.addWarning(`PRELUM: ${title}`, params);
            break;
        case 'success':
            notify.addSuccess(`PRELUM: ${title}`, params);
            break;
        default:
            notify.addInfo(`PRELUM: ${title}`, params);
    }

    plugin.bar.setColor(type);
}

export function clearLogs() {
    notify.getNotifications().forEach(i => {
        i.dismiss();
    });
}

export default log;