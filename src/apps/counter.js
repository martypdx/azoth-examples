import { _, $ } from 'azoth';
import { BehaviorSubject } from 'rxjs-es/BehaviorSubject';

export default () => {
    const count = new BehaviorSubject(0);
    const change = x => count.next(count.value + x);
    return counter(count, change);
};

const counter = (count=$, change) => {
    const positive = _`<p>Things are looking up!</p>`;
    const negative = _`
        <p>
            Things are going down :(
            <button onclick="confirm('feel better?')">panic</button>
        </p>
    `;

    return _`
        <p>Count is *${count}</p>
        <div>*${ count >= 0 ? positive : negative }#</div>
        <button onclick=${() => change(1)}>increment</button>
        <button onclick=${() => change(-1)}>decrement</button>
    `;
};