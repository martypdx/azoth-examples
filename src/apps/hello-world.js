import { _, $ } from 'diamond-ui';
import { BehaviorSubject } from 'rxjs-es/BehaviorSubject';
import { Observable } from 'rxjs-es/Observable';
import 'rxjs-es/add/operator/pluck';

Observable.prototype.child = Observable.prototype.pluck;

export default () => {
    const options = new BehaviorSubject({ 
        salutation: 'Hello',
        name: 'World' 
    });
    const change = value => {
        options.next(
            Object.assign({}, options.value, value)
        );
    };
    return hello(options, change);
};

const TextInput = (prop, val, change) => _`
    <div>
        ${prop}:
        <input value=${val} onkeyup=${({ target }) => change({ [prop]: target.value })}>
    </div>
`;

const hello = ({ name, salutation }=$, change) => {
    return _`
        <p>*${salutation} *${name}!</p>
        <div>
            $${TextInput('salutation', salutation, change)}#
            $${TextInput('name', name, change)}#
        </div>
    `;
};