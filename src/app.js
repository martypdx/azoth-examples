import { _, $ } from 'azoth';
import { BehaviorSubject } from 'rxjs-es/BehaviorSubject';
import counter from './apps/counter';
import hello from './apps/hello-world';
import ghRepo from './apps/github-repo';
import showHN from './apps/show-hn';
import starWars from './apps/starwars';

const apps = {
    'Hello World': hello,
    'Counter': counter,
    'GitHub Repos': ghRepo,
    'Show HN': showHN,
    'Star Wars': starWars
};

export default () => {
    const current = apps[window.location.hash.slice(1)];
    const app = new BehaviorSubject(current || hello);
    const change = value => void app.next(value);
    
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