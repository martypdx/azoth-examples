import { _, $ } from 'diamond-ui';
import { BehaviorSubject } from 'rxjs-es/BehaviorSubject';
import counter from './apps/counter';
import hello from './apps/hello-world';

const apps = {
    'Hello World': hello,
    'Counter': counter
};

export default () => {
    const app = new BehaviorSubject(hello);
    const change = value => app.next(value);
    
    return App(apps, app, change);
};

const App = (apps, app=$, change) => _`
    <header>
        <nav>
            <ul>
                ${Object.keys(apps).map(name => _`
                    <li onclick=${() => change(apps[name])}>${name}</li>
                `)}#
            </ul>
        </nav>
    </header>
    <main>
        <div>*${app}#</div>
    </main>
`;