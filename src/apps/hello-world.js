import { _, $ } from 'diamond-ui';
import { BehaviorSubject } from 'rxjs-es/BehaviorSubject';


export default () => {
    const name = new BehaviorSubject('World');
    const change = value => name.next(value);
    return hello(name, change);
};

const hello = (name=$, change) => {
    return _`
        <p>Hello *${name}!</p>
        <div>
            <input value=$${name} onkeyup=${({ target }) => change(target.value)}>
        </div>
    `;
};