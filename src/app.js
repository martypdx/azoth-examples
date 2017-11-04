import { _, $ } from 'azoth';
import { Observable } from 'rxjs-es/Observable';
import 'rxjs-es/add/observable/fromEvent';
import 'rxjs-es/add/operator/map';
import 'rxjs-es/add/operator/startWith';

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
    const app = Observable.fromEvent(window, 'hashchange')
        .startWith(null)
        .map(() => window.location.hash.slice(1))
        .map(name => ({ 
            name: name || 'Hello World', 
            app: apps[name] || hello 
        }));

    return App(Object.keys(apps), app);
};

const App = (names, { name, app }=$) => _`
    <header>
        <nav class="navbar" role="navigation" aria-label="main navigation">
            <div class="navbar-brand">
                <div class="navbar-item">
                    <h6 class="title is-6">Azoth Example Apps</h6>
                </div>
            </div>
            <div class="navbar-menu is-active">
                <div class="navbar-start">
                </div>
                <div class="navbar-end">
                    ${names.map(name => _`
                        <a href=${`#${name}`} class="navbar-item">${name}</a>
                    `)}#
                </div>                
            </div>
        </nav>
    </header>
    <main>
        <section class="hero is-primary">
            <div class="hero-body">
            <div class="container">
                <h1 class="title">*${name}</h1>
            </div>
            </div>
        </section>
        <section class="container">
            *${app}#
        </section>
    </main>
`;