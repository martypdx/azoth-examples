import resolve from 'rollup-plugin-node-resolve';
// import commonjs from 'rollup-plugin-commonjs';
import azoth from 'rollup-plugin-azoth';


export default {
    entry: 'src/index.js',
    format: 'es',
    plugins: [
        azoth(),
        resolve({ jsnext: true, module: true })
    ],
    // external: ['firebase']
    // sourceMap: true,
    dest: 'docs/bundle.js'
};