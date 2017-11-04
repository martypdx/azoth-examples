import { _, $ } from 'azoth';
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
    <div class="field">
        <label class="label is-capitalized">${prop}:</label>
        <div class="control">
            <input class="input" 
                value=${val} 
                onkeyup=${({ target }) => change({ [prop]: target.value })}
            >
        </div>
    </div>
`;

const hello = ({ name, salutation }=$, change) => {
    return _`
        <section class="section">
                <p class="is-size-4">*${salutation} *${name}!</p>
                <hr>
                <div class="container">
                    $${TextInput('salutation', salutation, change)}#
                    $${TextInput('name', name, change)}#
                </div>
        </section>
    `;
};